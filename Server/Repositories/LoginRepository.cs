using Microsoft.AspNetCore.Mvc;
using System.ComponentModel;

namespace Server;

public class LoginRepository
{
    public async Task<bool> Login(Login login)
    {
        return true;
    }

    public async Task<bool> Register(Login login)
    {
        return true;
    }
}