using FluentValidation;

namespace Validator;

public class UserLoginValidator : AbstractValidator<UserLoginDTO>
{
    public UserLoginValidator()
    {
        RuleFor(x => x.email).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.platform).NotEmpty().MaximumLength(32);
    }
}