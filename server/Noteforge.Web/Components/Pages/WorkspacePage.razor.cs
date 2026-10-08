using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Routing;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.JSInterop;
using Noteforge.Web.Models;
using Noteforge.Web.Services;

namespace Noteforge.Web.Components.Pages;

public partial class WorkspacePage
{
    [Inject] public PageStore Store { get; set; } = default!;
    [Inject] public AuthenticationStateProvider Authentication { get; set; } = default!;
    [Inject] public IJSRuntime JS { get; set; } = default!;
    private WorkspaceDocument? _workspace;
    private PageDocument? _active;
    private string _owner = "", _query = "", _saveStatus = "All changes saved";
    private string? _error, _modal;
    private bool _sidebar = true, _pageMenu, _dark, _dirty, _disposed;
    private long _revision;
    private CancellationTokenSource? _debounce;
    private readonly SemaphoreSlim _saveLock = new(1, 1);
    private DotNetObjectReference<WorkspacePage>? _reference;
    private string Initial => _workspace?.User.Name.FirstOrDefault().ToString().ToUpperInvariant() ?? "N";
    private string ModalTitle => _modal switch { "search" => "Search pages", "templates" => "Templates", "trash" => "Trash", "settings" => "Workspace settings", "move" => "Move page", _ => "Choose an icon" };
    private List<PageDocument> Visible => _workspace?.Pages.Where(p => !p.Archived && !HiddenByParent(p)).ToList() ?? [];

    protected override async Task OnInitializedAsync()
    {
        _owner = (await Authentication.GetAuthenticationStateAsync()).User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        if (string.IsNullOrEmpty(_owner)) return;
        try { _workspace = await Store.LoadAsync(_owner); _active = Visible.FirstOrDefault(p => p.Id.EndsWith(":home")) ?? Visible.FirstOrDefault(); }
        catch (Exception) { _error = "Your workspace could not be loaded. Please reload and try again."; }
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _reference = DotNetObjectReference.Create(this);
            var state = await JS.InvokeAsync<BrowserState>("noteforge.initialize", _reference);
            _sidebar = !state.Mobile;
            _dark = state.Dark;
            if (Visible.FirstOrDefault(p => p.Id == state.Page) is { } page) _active = page;
            StateHasChanged();
        }
        await JS.InvokeVoidAsync("noteforge.refresh", _dirty);
    }
    public sealed record BrowserState(bool Mobile, bool Dark, string Page);
    [JSInvokable] public Task OpenSearch() { OpenModal("search"); return InvokeAsync(StateHasChanged); }
    [JSInvokable] public Task SelectFromHash(string id) => Select(id);

    private bool HiddenByParent(PageDocument page)
    {
        var visited = new HashSet<string>();
        while (page.ParentId != null && visited.Add(page.Id))
        {
            var parent = _workspace!.Pages.Find(p => p.Id == page.ParentId);
            if (parent == null || parent.Archived) return true;
            page = parent;
        }
        return false;
    }
    private IEnumerable<PageDocument> Ancestors()
    {
        var parents = new List<PageDocument>(); var id = _active?.ParentId;
        while (id != null && parents.Count < 50)
        {
            var parent = _workspace!.Pages.Find(p => p.Id == id); if (parent == null) break;
            parents.Insert(0, parent); id = parent.ParentId;
        }
        return parents;
    }
    private HashSet<string> Descendants(string id)
    {
        var ids = new HashSet<string> { id }; bool found;
        do { found = false; foreach (var page in _workspace!.Pages) if (page.ParentId != null && ids.Contains(page.ParentId)) found |= ids.Add(page.Id); } while (found);
        return ids;
    }
    private void OpenModal(string modal) { _modal = modal; _pageMenu = false; _query = ""; }
    private Task GoHome() => Select(Visible.FirstOrDefault(p => p.Id.EndsWith(":home"))?.Id ?? Visible.FirstOrDefault()?.Id ?? "");
    private async Task Select(string id)
    {
        if (!await Save()) return;
        var page = Visible.Find(p => p.Id == id); if (page == null) return;
        _active = page; _modal = null; _pageMenu = false; _error = null;
        if (await JS.InvokeAsync<bool>("noteforge.navigate", id)) _sidebar = false;
    }
    private Task AddChild(string id) => Create(id);
    private async Task Create(string? parentId = null, object? fields = null)
    {
        if (!await Save()) return;
        try
        {
            var page = await Store.CreateAsync(_owner, JsonSerializer.SerializeToElement(fields ?? new { parentId }, PageDocument.Json));
            _workspace!.Pages.Add(page); await Select(page.Id);
        }
        catch (Exception error) { _error = Message(error); }
    }
    private Task CreateTemplate(string name)
    {
        var blocks = name switch
        {
            "Meeting notes" => new List<Block> { new() { Type = "heading2", Text = "Agenda" }, new() { Type = "bullet" }, new() { Type = "heading2", Text = "Decisions" }, new(), new() { Type = "heading2", Text = "Action items" }, new() { Type = "todo" } },
            "Daily journal" => [new() { Type = "heading2", Text = "Today I’m thinking about…" }, new(), new() { Type = "heading2", Text = "One thing I’m grateful for" }, new()],
            _ => [new()]
        };
        return Create(fields: new { title = name == "Blank page" ? "Untitled" : name, kind = name == "Project tracker" ? "database" : "document", icon = name == "Project tracker" ? "📋" : "📄", blocks, rows = Array.Empty<TaskRow>() });
    }
    private async Task Duplicate()
    {
        if (_active == null || !await Save()) return;
        var p = _active.Copy();
        foreach (var b in p.Blocks) b.Id = Guid.NewGuid().ToString();
        foreach (var r in p.Rows) r.Id = Guid.NewGuid().ToString();
        await Create(fields: new { p.ParentId, title = p.Title + " (copy)", p.Icon, p.Kind, p.Cover, p.Blocks, p.Rows });
    }
    private async Task Archive()
    {
        if (_active == null) return;
        _active.Archived = true; await Changed();
        if (await Save()) { _active = Visible.FirstOrDefault(); _pageMenu = false; }
    }
    private async Task Restore(PageDocument page)
    {
        if (!await Save()) return;
        try
        {
            var saved = await Store.UpdateAsync(_owner, page.Id, JsonSerializer.SerializeToElement(new { version = page.Version, archived = false }, PageDocument.Json));
            _workspace!.Pages[_workspace.Pages.FindIndex(p => p.Id == page.Id)] = saved;
            await Select(saved.Id);
        }
        catch (Exception error) { _error = Message(error); _modal = null; }
    }
    private async Task Move(string? id) { if (_active != null) { _active.ParentId = id; _modal = null; await Changed(); await Save(); } }
    private async Task ToggleFavorite() { if (_active != null) { _active.Favorite = !_active.Favorite; await Changed(); } }
    private async Task ChangeIcon(string icon) { if (_active != null) { _active.Icon = icon; _modal = null; await Changed(); } }
    private async Task ChangeCover() { if (_active != null) { var covers = new[] { "none", "blue", "violet", "slate" }; _active.Cover = covers[(Array.IndexOf(covers, _active.Cover) + 1) % covers.Length]; await Changed(); } }
    private async Task RemoveCover() { if (_active != null) { _active.Cover = "none"; await Changed(); } }
    private async Task ToggleTheme() { _dark = !_dark; await JS.InvokeVoidAsync("noteforge.theme", _dark); }

    private Task Changed()
    {
        _dirty = true; _revision++; _saveStatus = "Unsaved changes";
        _debounce?.Cancel(); _debounce?.Dispose(); _debounce = new();
        if (_error == null) _ = DebouncedSave(_debounce.Token);
        return Task.CompletedTask;
    }
    private async Task DebouncedSave(CancellationToken token)
    {
        try { await Task.Delay(650, token); await InvokeAsync(async () => { await Save(); if (!_disposed) StateHasChanged(); }); }
        catch (OperationCanceledException) { }
    }
    private async Task<bool> Save()
    {
        await _saveLock.WaitAsync();
        try
        {
            while (_dirty && _active != null)
            {
                var revision = _revision; var page = _active; var snapshot = page.Copy();
                _saveStatus = "Saving…";
                try
                {
                    var saved = await Store.UpdateAsync(_owner, page.Id, PageStore.Changes(snapshot));
                    page.Version = saved.Version; page.UpdatedAt = saved.UpdatedAt;
                    _dirty = revision != _revision; _error = null; _saveStatus = _dirty ? "Saving…" : "All changes saved";
                }
                catch (Exception error) { _error = Message(error); _saveStatus = "Not saved"; return false; }
            }
            return true;
        }
        finally { _saveLock.Release(); }
    }
    private async Task RetrySave() { await Save(); }
    private async Task GuardNavigation(LocationChangingContext context) { if (!await Save()) context.PreventNavigation(); }
    private static string Message(Exception error) => error is WorkspaceException ? error.Message : "Your changes could not be saved. Your draft is still here; retry or export it.";
    private async Task ExportMarkdown() { if (_active != null) await Download(_active.Title + ".md", MarkdownExport.Convert(_active), "text/markdown"); _pageMenu = false; }
    private async Task ExportDraft() { if (_active != null) await Download("noteforge-draft.json", JsonSerializer.Serialize(_active, PageDocument.Json), "application/json"); }
    private async Task ImportBackup(InputFileChangeEventArgs args)
    {
        if (!await Save()) return;
        try
        {
            await using var stream = args.File.OpenReadStream(2_000_000);
            using var json = await JsonDocument.ParseAsync(stream);
            var count = await Store.ImportAsync(_owner, json.RootElement);
            _workspace = await Store.LoadAsync(_owner); _active = Visible.LastOrDefault();
            _modal = null; _saveStatus = $"Imported {count} pages";
        }
        catch (Exception error) { _modal = null; _error = error is WorkspaceException ? error.Message : "The backup could not be read. Choose a Noteforge JSON backup smaller than 2 MB."; }
    }
    private Task ExportWorkspace() => Download("noteforge-backup.json", JsonSerializer.Serialize(_workspace, PageDocument.Json), "application/json");
    private async Task Download(string name, string content, string type) => await JS.InvokeVoidAsync("noteforge.download", name, content, type);
    public async ValueTask DisposeAsync()
    {
        _disposed = true; _debounce?.Cancel(); _debounce?.Dispose();
        try { await Save(); await JS.InvokeVoidAsync("noteforge.dispose"); } catch (Exception) { }
        _reference?.Dispose();
    }
}
