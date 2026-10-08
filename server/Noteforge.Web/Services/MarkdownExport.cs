using Noteforge.Web.Models;

namespace Noteforge.Web.Services;

public static class MarkdownExport
{
    public static string Convert(PageDocument page)
    {
        var blocks = page.Blocks.Select(b => b.Type switch
        {
            "heading1" => "# " + b.Text, "heading2" => "## " + b.Text, "heading3" => "### " + b.Text,
            "bullet" => "- " + b.Text, "numbered" => "1. " + b.Text,
            "todo" => $"- [{(b.Checked ? "x" : " ")}] {b.Text}",
            "quote" or "callout" => string.Join('\n', b.Text.Split('\n').Select(line => "> " + line)),
            "code" => "```\n" + b.Text + "\n```", "divider" => "---", _ => b.Text
        });
        var text = "# " + page.Title + "\n\n" + string.Join("\n\n", blocks);
        if (page.Kind == "database") text += "\n\n| Name | Status | Priority | Assignee | Due date |\n| --- | --- | --- | --- | --- |\n" + string.Join('\n', page.Rows.Select(r => "| " + string.Join(" | ", new[] { r.Title, r.Status, r.Priority, r.Assignee, r.Due }.Select(Cell)) + " |"));
        return text + "\n";
    }
    private static string Cell(string value) => value.Replace("|", "\\|").Replace("\n", " ");
}
