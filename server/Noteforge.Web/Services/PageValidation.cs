using System.Globalization;
using System.Text.Json;
using Noteforge.Web.Models;

namespace Noteforge.Web.Services;

public static class PageValidation
{
    public static readonly string[] BlockTypes = ["text", "heading1", "heading2", "heading3", "bullet", "numbered", "todo", "quote", "callout", "code", "divider"];
    public static readonly string[] Statuses = ["Not started", "In progress", "Done"];
    public static readonly string[] Priorities = ["Low", "Medium", "High"];
    private static readonly HashSet<string> Fields = ["parentId", "title", "icon", "kind", "cover", "favorite", "archived", "blocks", "rows"];

    public static PageDocument Apply(PageDocument current, JsonElement input, bool updating)
    {
        if (input.ValueKind != JsonValueKind.Object) throw Invalid();
        var page = current.Copy();
        var seen = new HashSet<string>();
        foreach (var field in input.EnumerateObject())
        {
            if (!seen.Add(field.Name) || (!Fields.Contains(field.Name) && !(updating && field.Name == "version"))) throw Invalid();
            try
            {
                switch (field.Name)
                {
                    case "parentId": page.ParentId = field.Value.ValueKind == JsonValueKind.Null ? null : field.Value.GetString(); break;
                    case "title": page.Title = field.Value.GetString()!; break;
                    case "icon": page.Icon = field.Value.GetString()!; break;
                    case "kind": page.Kind = field.Value.GetString()!; break;
                    case "cover": page.Cover = field.Value.GetString()!; break;
                    case "favorite": page.Favorite = field.Value.GetBoolean(); break;
                    case "archived": page.Archived = field.Value.GetBoolean(); break;
                    case "blocks":
                        RequireFields(field.Value, ["id", "type", "text"]);
                        page.Blocks = field.Value.Deserialize<List<Block>>(PageDocument.Json)!; break;
                    case "rows":
                        RequireFields(field.Value, ["id", "title", "status", "priority", "assignee", "due", "notes"]);
                        page.Rows = field.Value.Deserialize<List<TaskRow>>(PageDocument.Json)!; break;
                    case "version": page.Version = field.Value.GetInt32(); break;
                }
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException or FormatException or OverflowException) { throw Invalid(); }
        }
        if (updating && (!seen.Contains("version") || page.Version < 1 || page.Version == int.MaxValue)) throw Invalid();
        Validate(page);
        return page;
    }

    private static void RequireFields(JsonElement items, string[] required)
    {
        if (items.ValueKind != JsonValueKind.Array) throw Invalid();
        foreach (var item in items.EnumerateArray())
            if (item.ValueKind != JsonValueKind.Object || required.Any(name => !item.TryGetProperty(name, out _)) ||
                item.EnumerateObject().Select(x => x.Name).Distinct().Count() != item.EnumerateObject().Count()) throw Invalid();
    }

    public static void Validate(PageDocument p)
    {
        if (!Text(p.Title, 500) || !Text(p.Icon, 20, 1) || (p.ParentId != null && !Text(p.ParentId, 200, 1)) ||
            !new[] { "document", "database" }.Contains(p.Kind) || !new[] { "none", "blue", "violet", "slate" }.Contains(p.Cover) ||
            p.Blocks == null || p.Rows == null || p.Blocks.Count > 1000 || p.Rows.Count > 2000) throw Invalid();
        if (p.Blocks.Any(b => b == null || !Text(b.Id, 100, 1) || !BlockTypes.Contains(b.Type) || !Text(b.Text, 30000)) ||
            p.Blocks.Select(b => b.Id).Distinct().Count() != p.Blocks.Count) throw Invalid();
        if (p.Rows.Any(r => r == null || !Text(r.Id, 100, 1) || !Text(r.Title, 1000) || !Statuses.Contains(r.Status) ||
            !Priorities.Contains(r.Priority) || !Text(r.Assignee, 200) || !Text(r.Notes, 10000) ||
            (r.Due != "" && !DateOnly.TryParseExact(r.Due, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))) ||
            p.Rows.Select(r => r.Id).Distinct().Count() != p.Rows.Count) throw Invalid();
    }
    private static bool Text(string? value, int maximum, int minimum = 0) => value != null && value.Length >= minimum && value.Length <= maximum;
    private static WorkspaceException Invalid() => new(400, "Some page fields are invalid.");
}
