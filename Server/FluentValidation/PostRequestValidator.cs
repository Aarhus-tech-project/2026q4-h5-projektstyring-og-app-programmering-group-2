using FluentValidation;
using Server;

namespace Validator;

public class PostRequestValidator : AbstractValidator<PostsController.PostRequest>
{
    public PostRequestValidator()
    {
        RuleFor(x => x.File).Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A file is required.")
            .Must(f => f.Length > 0).WithMessage("The file is empty.");
    }
}
