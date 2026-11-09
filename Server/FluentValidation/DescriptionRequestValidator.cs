using FluentValidation;
using Server;

namespace Validator;

public class DescriptionRequestValidator : AbstractValidator<PostsController.DescriptionRequest>
{
    public DescriptionRequestValidator()
    {
        RuleFor(x => x.Description)
            .Must(d => d == null || d.Trim().Length <= 250)
            .WithMessage("Description can be at most 250 characters.");
    }
}
