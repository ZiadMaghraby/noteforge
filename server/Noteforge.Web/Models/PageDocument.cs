using System.Text.Json;
using System.Text.Json.Serialization;

namespace Noteforge.Web.Models;

public sealed class Block
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Type { get; set; } = "text";
    public string Text { get; set; } = "";
    public bool Checked { get; set; }
}

public sealed class TaskRow
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = "Untitled task";
    public string Status { get; set; } = "Not started";
    public string Priority { get; set; } = "Medium";
    public string Assignee { get; set; } = "";
    public string Due { get; set; } = "";
    public string Notes { get; set; } = "";
}

public sealed class PageDocument
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? ParentId { get; set; }
    public string Title { get; set; } = "Untitled";
    public string Icon { get; set; } = "📄";
    public string Kind { get; set; } = "document";
    public string Cover { get; set; } = "none";
    public bool Favorite { get; set; }
    public bool Archived { get; set; }
    public List<Block> Blocks { get; set; } = [new()];
    public List<TaskRow> Rows { get; set; } = [];
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public PageDocument Copy() => JsonSerializer.Deserialize<PageDocument>(JsonSerializer.Serialize(this, Json), Json)!;
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };
}

public sealed record WorkspaceUser(string Name, string Email);
public sealed record WorkspaceDocument(string Name, WorkspaceUser User, List<PageDocument> Pages);
public sealed class WorkspaceException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
