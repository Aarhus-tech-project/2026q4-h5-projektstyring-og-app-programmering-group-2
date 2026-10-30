namespace Server.Exceptions
{
    public class ApiException(string message, int statusCode) : Exception(message)
    {
        public int StatusCode { get; } = statusCode;
    }

    public class InvalidLoginException() : ApiException("Invalid email or password", 401);
    public class InvalidEmailSyntaxException() : ApiException("Invalid email syntax", 400);
    public class EmailFindesAlleredeException() : ApiException("Email findes allerede", 409);
}