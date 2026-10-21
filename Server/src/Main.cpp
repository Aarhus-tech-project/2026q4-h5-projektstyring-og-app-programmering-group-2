// Main.cpp : Defines the entry point for the application.
//

#include "Server.h"

using namespace std;

int main()
{
	test::PingRequest request;
	request.set_message("Hello proto.");
	cout << request.message() << endl;
	return 0;
}
