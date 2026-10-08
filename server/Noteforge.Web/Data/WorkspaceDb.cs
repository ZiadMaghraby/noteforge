using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Noteforge.Web.Data;

public sealed class WorkspaceUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
}

public sealed class WorkspaceEntity
{
    public string OwnerId { get; set; } = "";
    public string Name { get; set; } = "My workspace";
}

public sealed class PageEntity
{
    public string Id { get; set; } = "";
    public string OwnerId { get; set; } = "";
    public string? ParentId { get; set; }
    public int Version { get; set; }
    public string Document { get; set; } = "";
}

public sealed class WorkspaceDb(DbContextOptions<WorkspaceDb> options) : IdentityDbContext<WorkspaceUser>(options)
{
    public DbSet<WorkspaceEntity> Workspaces => Set<WorkspaceEntity>();
    public DbSet<PageEntity> Pages => Set<PageEntity>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        base.OnModelCreating(model);
        model.Entity<WorkspaceEntity>().HasKey(x => x.OwnerId);
        model.Entity<WorkspaceEntity>().HasOne<WorkspaceUser>().WithOne().HasForeignKey<WorkspaceEntity>(x => x.OwnerId);
        model.Entity<PageEntity>().HasKey(x => x.Id);
        model.Entity<PageEntity>().HasIndex(x => new { x.OwnerId, x.ParentId });
        model.Entity<PageEntity>().Property(x => x.Version).IsConcurrencyToken();
        model.Entity<PageEntity>().HasOne<WorkspaceEntity>().WithMany().HasForeignKey(x => x.OwnerId);
    }
}
