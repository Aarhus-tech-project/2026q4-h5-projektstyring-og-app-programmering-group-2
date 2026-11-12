using FluentValidation;
using Microsoft.AspNetCore.Http;
using Server;
using Server.Controllers;

namespace Validator;

public class PostRequestValidator : AbstractValidator<PostsController.PostRequest>
{
    public PostRequestValidator()
    {
        RuleFor(x => x.File).ValidUpload();

        RuleFor(x => x)
            .Must(x => x.CropX is null == (x.CropY is null) && x.CropX is null == (x.CropSize is null))
            .WithName("Crop")
            .WithMessage("CropX, CropY and CropSize must be sent together.");

        RuleFor(x => x.CropX).InclusiveBetween(0f, 1f);
        RuleFor(x => x.CropY).InclusiveBetween(0f, 1f);
        RuleFor(x => x.CropSize).GreaterThan(0f).LessThanOrEqualTo(1f);
    }
}

public class AvatarRequestValidator : AbstractValidator<ProfileController.AvatarRequest>
{
    public AvatarRequestValidator()
    {
        RuleFor(x => x.File).ValidUpload();
    }
}

public static class UploadRules
{
    public static IRuleBuilderOptions<T, IFormFile> ValidUpload<T>(this IRuleBuilder<T, IFormFile> rule) =>
        rule.NotNull().WithMessage("A file is required.")
            .Must(f => f is null || f.Length > 0).WithMessage("The file is empty.");
}
