using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Noteforge.Web.Models;

namespace Noteforge.Tests;

public sealed class AppFactory(string database) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Workspace", $"Data Source={database};Pooling=False");
    }
}

public sealed class WorkspaceTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "noteforge-tests-" + Guid.NewGuid());
    private readonly AppFactory _app;
    public WorkspaceTests() { Directory.CreateDirectory(_directory); _app = new(Path.Combine(_directory, "workspace.db")); }
    private HttpClient Client() => _app.CreateClient(new() { AllowAutoRedirect = false, HandleCookies = true });

    private static async Task<HttpResponseMessage> Write(HttpClient client, string path, object input, HttpMethod? method = null)
    {
        var token = await client.GetFromJsonAsync<JsonElement>("/api/antiforgery");
        using var request = new HttpRequestMessage(method ?? HttpMethod.Post, path) { Content = JsonContent.Create(input) };
        request.Headers.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
        return await client.SendAsync(request);
    }
    private static async Task<string> Register(HttpClient client)
    {
        var email = Guid.NewGuid() + "@example.test";
        var response = await Write(client, "/api/auth/register", new { email, password = "NoteforgeTest123!", name = "Test Writer" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return email;
    }
    private static async Task<PageDocument> Create(HttpClient client, object? input = null)
    {
        var response = await Write(client, "/api/pages", input ?? new { title = "Integration test" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PageDocument>())!;
    }

    [Fact]
    public async Task Authentication_csrf_and_signout_are_enforced()
    {
        using var client = Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/workspace")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/register", new { email = "a@example.test", password = "NoteforgeTest123!", name = "A" })).StatusCode);
        var email = await Register(client);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/workspace")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/pages", new { title = "No token" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Write(client, "/api/auth/logout", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/workspace")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Write(client, "/api/auth/login", new { email, password = "WrongPassword123" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Write(client, "/api/auth/login", new { email, password = "NoteforgeTest123!" })).StatusCode);
    }

    [Fact]
    public async Task Pages_are_isolated_between_accounts()
    {
        using var alice = Client(); using var bob = Client();
        await Register(alice); await Register(bob);
        var page = await Create(alice, new { title = "Alice private page" });
        var workspace = (await bob.GetFromJsonAsync<WorkspaceDocument>("/api/workspace"))!;
        Assert.DoesNotContain(workspace.Pages, p => p.Id == page.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await Write(bob, "/api/pages/" + page.Id, new { version = 1, title = "Stolen" }, HttpMethod.Patch)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Write(bob, "/api/pages", new { parentId = page.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(bob, "/api/pages", new { ownerId = "alice" })).StatusCode);
    }

    [Fact]
    public async Task Saves_detect_conflicts_and_survive_a_new_server_instance()
    {
        using var client = Client(); var email = await Register(client);
        var page = await Create(client);
        var updated = await Write(client, "/api/pages/" + page.Id, new { version = 1, title = "Persisted title", blocks = new[] { new { id = "b1", type = "todo", text = "Saved block", @checked = true } } }, HttpMethod.Patch);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Write(client, "/api/pages/" + page.Id, new { version = 1, title = "Stale title" }, HttpMethod.Patch)).StatusCode);
        using var restarted = new AppFactory(Path.Combine(_directory, "workspace.db"));
        using var otherClient = restarted.CreateClient(new() { AllowAutoRedirect = false, HandleCookies = true });
        Assert.Equal(HttpStatusCode.OK, (await Write(otherClient, "/api/auth/login", new { email, password = "NoteforgeTest123!" })).StatusCode);
        var workspace = (await otherClient.GetFromJsonAsync<WorkspaceDocument>("/api/workspace"))!;
        var stored = Assert.Single(workspace.Pages, p => p.Id == page.Id);
        Assert.Equal("Persisted title", stored.Title); Assert.Equal(2, stored.Version); Assert.True(stored.Blocks[0].Checked);
    }

    [Fact]
    public async Task Parent_cycles_archived_parents_and_invalid_fields_are_rejected()
    {
        using var client = Client(); await Register(client);
        var parent = await Create(client);
        var child = await Create(client, new { parentId = parent.Id, title = "Child" });
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, "/api/pages/" + parent.Id, new { version = 1, parentId = child.Id }, HttpMethod.Patch)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Write(client, "/api/pages/" + parent.Id, new { version = 1, archived = true }, HttpMethod.Patch)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, "/api/pages", new { parentId = parent.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Write(client, "/api/pages/" + parent.Id, new { version = 2, archived = false }, HttpMethod.Patch)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, "/api/pages", new { blocks = new[] { new { id = "same", type = "text", text = "one" }, new { id = "same", type = "text", text = "two" } } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, "/api/pages", new { title = (string?)null })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, "/api/pages", new { rows = new[] { new { id = "r", title = "Task", status = "Done", priority = "High", assignee = "", notes = "", due = "2026-02-31" } } })).StatusCode);
    }

    [Fact]
    public async Task Database_rows_round_trip_and_markdown_escapes_cells()
    {
        using var client = Client(); await Register(client);
        var page = await Create(client, new { kind = "database", rows = new[] { new TaskRow { Title = "A | B", Status = "Done", Priority = "High", Notes = "Details" } } });
        var workspace = (await client.GetFromJsonAsync<WorkspaceDocument>("/api/workspace"))!;
        Assert.Equal("Details", workspace.Pages.Single(p => p.Id == page.Id).Rows[0].Notes);
        Assert.Contains("A \\| B", Noteforge.Web.Services.MarkdownExport.Convert(page));
    }

    [Fact]
    public async Task Imports_remap_hierarchy_preserve_existing_pages_and_reject_cycles_atomically()
    {
        using var client = Client(); await Register(client);
        var original = await Create(client);
        var backup = new { pages = new[] {
            new PageDocument { Id = original.Id, Title = "Imported parent" },
            new PageDocument { Id = "child", ParentId = original.Id, Title = "Imported child" }
        } };
        Assert.Equal(HttpStatusCode.OK, (await Write(client, "/api/import", backup)).StatusCode);
        var workspace = (await client.GetFromJsonAsync<WorkspaceDocument>("/api/workspace"))!;
        Assert.Equal(original.Title, workspace.Pages.Single(p => p.Id == original.Id).Title);
        var parent = Assert.Single(workspace.Pages, p => p.Title == "Imported parent");
        var child = Assert.Single(workspace.Pages, p => p.Title == "Imported child");
        Assert.NotEqual(original.Id, parent.Id); Assert.NotEqual("child", child.Id);
        Assert.Equal(parent.Id, child.ParentId);
        var invalid = new { pages = new[] { new PageDocument { Id = "loop", ParentId = "loop" } } };
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, "/api/import", invalid)).StatusCode);
        var after = (await client.GetFromJsonAsync<WorkspaceDocument>("/api/workspace"))!;
        Assert.Equal(workspace.Pages.Count, after.Pages.Count);
    }

    public void Dispose()
    {
        _app.Dispose();
        Directory.Delete(_directory, recursive: true);
    }
}
