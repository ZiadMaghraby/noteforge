using Noteforge.Web.Models;
using Noteforge.Web.Services;
namespace Noteforge.Tests;
public class MarkdownExportTests
{
    [Theory]
    [InlineData("hello", "```")]
    [InlineData("before\n```\nafter", "````")]
    [InlineData("`````", "``````")]
    public void Code_blocks_preserve_embedded_backtick_fences(string content, string fence)
    {
        var page = new PageDocument { Title = "Example", Blocks = [new Block { Type = "code", Text = content }] };
        Assert.Equal("# Example\n\n" + fence + "\n" + content + "\n" + fence + "\n", MarkdownExport.Convert(page));
    }
}
