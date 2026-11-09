using FluentValidation;

namespace Validator;

public class UserLoginValidator : AbstractValidator<UserLoginDTO>
{
    public UserLoginValidator()
    {
        RuleFor(x => x.email).NotEmpty().MaximumLength(254);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(128);
        RuleFor(x => x.deviceName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.platform).NotEmpty().MaximumLength(32);
    }
}