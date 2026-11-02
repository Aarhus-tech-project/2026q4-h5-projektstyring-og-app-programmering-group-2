namespace Server.Exceptions
{
    public class ApiException(string message, int statusCode) : Exception(message)
    {
        public int StatusCode { get; } = statusCode;
    }

    public class InvalidLoginException() : ApiException("Invalid email or password", 401);
    public class BlobUploadInternalServerException() : ApiException("Internal server error", 502);
    public class FailedToCreateInDatabaseException() : ApiException("Failed to create", 500);
    public class VoteAlreadySubmittedException() : ApiException("Vote already submitted", 409);
    public class MatchupDoesntExistException() : ApiException("Matchup doesnt exist", 404);
}