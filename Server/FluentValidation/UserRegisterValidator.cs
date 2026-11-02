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
        RuleFor(x => x.Password).NotEmpty().Length(8, 128);
    }
}