using System.Security.Claims;
using System.Text.Json;
using Noteforge.Web.Services;

namespace Noteforge.Web.Endpoints;

public static class WorkspaceEndpoints
{
    public static void MapWorkspace(this WebApplication app)
    {
        var group = app.MapGroup("/api").RequireAuthorization();
        group.MapGet("/workspace", async (ClaimsPrincipal user, PageStore store, HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            return Results.Ok(await store.LoadAsync(user.FindFirstValue(ClaimTypes.NameIdentifier)!));
        });
        group.MapPost("/pages", async (ClaimsPrincipal user, PageStore store, JsonElement input) =>
        {
            var page = await store.CreateAsync(user.FindFirstValue(ClaimTypes.NameIdentifier)!, input);
            return Results.Created("/api/pages/" + Uri.EscapeDataString(page.Id), page);
        });
        group.MapPatch("/pages/{id}", async (string id, ClaimsPrincipal user, PageStore store, JsonElement input) =>
            Results.Ok(await store.UpdateAsync(user.FindFirstValue(ClaimTypes.NameIdentifier)!, id, input)));
        group.MapPost("/import", async (ClaimsPrincipal user, PageStore store, JsonElement input) =>
            Results.Ok(new { imported = await store.ImportAsync(user.FindFirstValue(ClaimTypes.NameIdentifier)!, input) }));
    }
}
