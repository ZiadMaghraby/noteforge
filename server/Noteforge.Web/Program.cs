using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Noteforge.Web.Components;
using Noteforge.Web.Data;
using Noteforge.Web.Endpoints;
using Noteforge.Web.Models;
using Noteforge.Web.Services;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2_000_000);
builder.Services.AddRazorComponents().AddInteractiveServerComponents().AddHubOptions(options => options.MaximumReceiveMessageSize = 2_000_000);
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddDbContextFactory<WorkspaceDb>(options => options.UseSqlite(builder.Configuration.GetConnectionString("Workspace") ?? "Data Source=noteforge.db"));
builder.Services.AddIdentity<Noteforge.Web.Data.WorkspaceUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 10;
    options.Password.RequireNonAlphanumeric = false;
    options.Lockout.MaxFailedAccessAttempts = 5;
}).AddEntityFrameworkStores<WorkspaceDb>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "Noteforge.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.LoginPath = "/signin";
    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api")) context.Response.StatusCode = 401;
        else context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});
builder.Services.AddAntiforgery(options => options.HeaderName = "X-CSRF-TOKEN");
builder.Services.AddScoped<PageStore>();
builder.Services.AddRateLimiter(options => options.AddPolicy("accounts", context => RateLimitPartition.GetFixedWindowLimiter(
    context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })));

var app = builder.Build();

if (app.Configuration.GetValue("Database:ApplyMigrations", true))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<WorkspaceDb>().Database.MigrateAsync();
}
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (WorkspaceException error) { context.Response.StatusCode = error.Status; await context.Response.WriteAsJsonAsync(new { error = error.Message }); }
    catch (BadHttpRequestException error) { context.Response.StatusCode = error.StatusCode; await context.Response.WriteAsJsonAsync(new { error = "The request could not be read." }); }
    catch (Exception error)
    {
        app.Logger.LogError(error, "Request failed");
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new { error = "The workspace could not be saved or loaded. Please try again." });
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseAntiforgery();
app.Use(async (context, next) =>
{
    if ((context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/auth")) &&
        context.Request.Method is "POST" or "PATCH" or "PUT" or "DELETE")
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { error = "Refresh the page and try again." });
            return;
        }
    }
    await next();
});
app.MapAccounts();
app.MapWorkspace();
app.MapStaticAssets();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

public partial class Program { }
