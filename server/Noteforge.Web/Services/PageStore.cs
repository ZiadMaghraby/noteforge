using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Noteforge.Web.Data;
using Noteforge.Web.Models;

namespace Noteforge.Web.Services;

public sealed class PageStore(IDbContextFactory<WorkspaceDb> factory)
{
    private static PageDocument Decode(PageEntity entity) => JsonSerializer.Deserialize<PageDocument>(entity.Document, PageDocument.Json)!;
    private static PageEntity Encode(string owner, PageDocument page) => new() { Id = page.Id, OwnerId = owner, ParentId = page.ParentId, Version = page.Version, Document = JsonSerializer.Serialize(page, PageDocument.Json) };

    public async Task<WorkspaceDocument> LoadAsync(string owner)
    {
        await using var db = await factory.CreateDbContextAsync();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == owner) ?? throw new WorkspaceException(401, "Sign in to open your workspace.");
        if (!await db.Workspaces.AnyAsync(x => x.OwnerId == owner))
        {
            db.Workspaces.Add(new() { OwnerId = owner });
            using var stream = typeof(PageStore).Assembly.GetManifestResourceStream("Noteforge.Web.Data.starter-pages.json")!;
            var starter = (await JsonSerializer.DeserializeAsync<List<PageDocument>>(stream, PageDocument.Json))!;
            foreach (var page in starter)
            {
                page.Id = page.Id.Replace("seed:", owner + ":");
                page.ParentId = page.ParentId?.Replace("seed:", owner + ":");
                page.CreatedAt = page.UpdatedAt = DateTimeOffset.UtcNow;
                db.Pages.Add(Encode(owner, page));
            }
            await db.SaveChangesAsync();
        }
        var workspace = await db.Workspaces.SingleAsync(x => x.OwnerId == owner);
        var pages = await db.Pages.AsNoTracking().Where(x => x.OwnerId == owner).ToListAsync();
        await transaction.CommitAsync();
        return new(workspace.Name, new Models.WorkspaceUser(user.DisplayName, user.Email!), pages.Select(Decode).OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToList());
    }

    public async Task<PageDocument> CreateAsync(string owner, JsonElement input)
    {
        var page = PageValidation.Apply(new(), input, false);
        await LoadAsync(owner);
        await using var db = await factory.CreateDbContextAsync();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await CheckParent(db, owner, page.ParentId, page.Id);
        db.Pages.Add(Encode(owner, page));
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return page;
    }

    public async Task<PageDocument> UpdateAsync(string owner, string id, JsonElement input)
    {
        await using var db = await factory.CreateDbContextAsync();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var entity = await db.Pages.SingleOrDefaultAsync(x => x.OwnerId == owner && x.Id == id) ?? throw new WorkspaceException(404, "This page does not exist.");
        var page = PageValidation.Apply(Decode(entity), input, true);
        if (page.Version != entity.Version) throw new WorkspaceException(409, "This page changed in another window. Export your draft, then reload the saved page.");
        await CheckParent(db, owner, page.ParentId, page.Id);
        page.Version++;
        page.UpdatedAt = DateTimeOffset.UtcNow;
        entity.Version = page.Version;
        entity.ParentId = page.ParentId;
        entity.Document = JsonSerializer.Serialize(page, PageDocument.Json);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new WorkspaceException(409, "This page changed in another window. Export your draft before reloading."); }
        await transaction.CommitAsync();
        return page;
    }

    private static async Task CheckParent(WorkspaceDb db, string owner, string? parentId, string pageId)
    {
        var visited = new HashSet<string> { pageId };
        while (parentId != null)
        {
            if (!visited.Add(parentId)) throw new WorkspaceException(400, "A page cannot be moved inside itself.");
            var parent = await db.Pages.AsNoTracking().SingleOrDefaultAsync(x => x.OwnerId == owner && x.Id == parentId) ?? throw new WorkspaceException(404, "The parent page does not exist.");
            if (Decode(parent).Archived) throw new WorkspaceException(400, "Restore the parent page first.");
            parentId = parent.ParentId;
        }
    }

    public async Task<int> ImportAsync(string owner, JsonElement backup)
    {
        if (backup.ValueKind != JsonValueKind.Object || !backup.TryGetProperty("pages", out var items) || items.ValueKind != JsonValueKind.Array || items.GetArrayLength() > 500)
            throw new WorkspaceException(400, "Choose a Noteforge JSON backup with at most 500 pages.");
        List<PageDocument> pages;
        try { pages = items.Deserialize<List<PageDocument>>(PageDocument.Json)!; }
        catch (JsonException) { throw new WorkspaceException(400, "The backup contains invalid page data."); }
        if (pages.Any(p => p == null || string.IsNullOrEmpty(p.Id) || p.Id.Length > 200) || pages.Select(p => p.Id).Distinct().Count() != pages.Count)
            throw new WorkspaceException(400, "Backup page IDs must be unique.");
        var byId = pages.ToDictionary(p => p.Id);
        foreach (var page in pages)
        {
            PageValidation.Validate(page);
            var seen = new HashSet<string> { page.Id }; var parent = page.ParentId;
            while (parent != null)
            {
                if (!seen.Add(parent) || !byId.TryGetValue(parent, out var ancestor)) throw new WorkspaceException(400, "The backup has a missing or circular parent.");
                parent = ancestor.ParentId;
            }
        }
        var newIds = pages.ToDictionary(p => p.Id, _ => Guid.NewGuid().ToString());
        await LoadAsync(owner);
        await using var db = await factory.CreateDbContextAsync();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        foreach (var page in pages)
        {
            page.Id = newIds[page.Id]; page.ParentId = page.ParentId == null ? null : newIds[page.ParentId];
            page.Version = 1; page.CreatedAt = page.UpdatedAt = DateTimeOffset.UtcNow;
            db.Pages.Add(Encode(owner, page));
        }
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return pages.Count;
    }

    public static JsonElement Changes(PageDocument p) => JsonSerializer.SerializeToElement(new { p.ParentId, p.Title, p.Icon, p.Kind, p.Cover, p.Favorite, p.Archived, p.Blocks, p.Rows, p.Version }, PageDocument.Json);
}
