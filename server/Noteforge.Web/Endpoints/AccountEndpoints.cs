using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Noteforge.Web.Data;

namespace Noteforge.Web.Endpoints;

public static class AccountEndpoints
{
    public sealed record RegisterInput(string Email, string Password, string Name);
    public sealed record LoginInput(string Email, string Password);

    public static void MapAccounts(this WebApplication app)
    {
        app.MapGet("/api/antiforgery", (HttpContext context, IAntiforgery csrf) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            return Results.Ok(new { token = csrf.GetAndStoreTokens(context).RequestToken });
        });
        app.MapPost("/api/auth/register", async (RegisterInput input, UserManager<WorkspaceUser> users, SignInManager<WorkspaceUser> signIn) =>
        {
            var error = await Register(input, users, signIn);
            return error == null ? Results.Ok(new { success = true }) : Results.BadRequest(new { error });
        }).RequireRateLimiting("accounts");
        app.MapPost("/api/auth/login", async (LoginInput input, SignInManager<WorkspaceUser> signIn) =>
        {
            if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 254 || string.IsNullOrEmpty(input.Password) || input.Password.Length > 256)
                return Results.BadRequest(new { error = "Enter an email and password." });
            var result = await signIn.PasswordSignInAsync(input.Email, input.Password, false, true);
            return result.Succeeded ? Results.Ok(new { success = true }) : Results.Json(new { error = "Email or password is incorrect, or sign-in is temporarily locked." }, statusCode: 401);
        }).RequireRateLimiting("accounts");
        app.MapPost("/auth/register", async (HttpContext context, UserManager<WorkspaceUser> users, SignInManager<WorkspaceUser> signIn) =>
        {
            var form = await context.Request.ReadFormAsync();
            var error = await Register(new(form["email"].ToString(), form["password"].ToString(), form["name"].ToString()), users, signIn);
            return Results.LocalRedirect(error == null ? "/" : "/register?error=" + Uri.EscapeDataString(error));
        }).RequireRateLimiting("accounts");
        app.MapPost("/auth/login", async (HttpContext context, SignInManager<WorkspaceUser> signIn) =>
        {
            var form = await context.Request.ReadFormAsync();
            var result = await signIn.PasswordSignInAsync(form["email"].ToString(), form["password"].ToString(), false, true);
            return Results.LocalRedirect(result.Succeeded ? "/" : "/signin?error=" + Uri.EscapeDataString("Email or password is incorrect, or sign-in is temporarily locked."));
        }).RequireRateLimiting("accounts");
        app.MapPost("/auth/logout", async (SignInManager<WorkspaceUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.LocalRedirect("/signin");
        }).RequireAuthorization();
        app.MapPost("/api/auth/logout", async (SignInManager<WorkspaceUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.Ok(new { success = true });
        }).RequireAuthorization();
    }

    private static async Task<string?> Register(RegisterInput input, UserManager<WorkspaceUser> users, SignInManager<WorkspaceUser> signIn)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 100 || string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 254 || input.Password == null || input.Password.Length > 256)
            return "Enter a name, email, and password.";
        var user = new WorkspaceUser { UserName = input.Email.Trim(), Email = input.Email.Trim(), DisplayName = input.Name.Trim() };
        var result = await users.CreateAsync(user, input.Password);
        if (!result.Succeeded) return "Could not create the account. Use a valid email and a password of at least 10 characters with uppercase, lowercase, and a number. The email may already be registered.";
        await signIn.SignInAsync(user, false);
        return null;
    }
}
