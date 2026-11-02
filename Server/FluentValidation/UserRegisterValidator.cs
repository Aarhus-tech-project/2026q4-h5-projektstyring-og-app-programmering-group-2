using FluentValidation;
using System.Net.Mail;

namespace Validator;

public class UserRegisterValidator : AbstractValidator<UserRegisterDTO>
{
    public UserRegisterValidator()
    {
        RuleFor(x => x.Username).NotEmpty().Length(3, 32).Matches("^[a-zA-Z0-9_.-]+$");
        RuleFor(x => x.Email).NotEmpty().MaximumLength(254)
            .Must(e => MailAddress.TryCreate(e, out var m) && m.Address == e)
            .WithMessage("Invalid email.");
        RuleFor(x => x.Password).Cascade(CascadeMode.Stop)
            .NotEmpty()
            .Length(12, 128)
            .Matches("[0-9]").WithMessage("Password must contain a number.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Password must contain a special character.")
            .Must((x, p) => string.IsNullOrEmpty(x.Username) || !p.Contains(x.Username, StringComparison.OrdinalIgnoreCase))
            .WithMessage("Password must not contain the username.")
            .Must((x, p) => !string.Equals(p, x.Email, StringComparison.OrdinalIgnoreCase))
            .WithMessage("Password must not be the email.");
    }
}