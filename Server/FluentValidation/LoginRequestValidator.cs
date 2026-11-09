using FluentValidation;

namespace Validator;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().MaximumLength(254);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(128);
        RuleFor(x => x.DeviceName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Platform).NotEmpty().MaximumLength(32);
    }
}