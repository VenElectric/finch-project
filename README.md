# How to Run

1. Ensure that docker is installed https://docs.docker.com/get-started/introduction/get-docker-desktop/
2. When docker is installed, open docker desktop to ensure docker is running.
3. Usiung a terminal, cd into the directory where you cloned this repo (i.e. cd path/to/finch-project). Or open the project in your favorite IDE and open a terminal from there
4. Create your .env file in the top level (i.e. same level as server.js, using the sample.env as an example)
    - Generate a secure secret (i.e. using a password manager or create one yourself) and add that to the CRYPT_SECRET variable
    - Add your CLIENT_ID and CLIENT_SECRET to the .env file. You can grab these from your Finch dashboard https://developer.tryfinch.com/implementation-guide/Connect/Create-Account
    - Add the redirect URI http://localhost:3000/redirect to your finch dashboard https://developer.tryfinch.com/implementation-guide/Connect/Create-Account#add-redirect-uris
    - Enter your customer name and customer ID in the env file. 
    - ensure DB_PATH="./db/database.db" is in your env file.
5. Your .env file should look like the sample.env file provided (with the above items filled out)
6. Run docker compose up in your terminal
7. Navigate to http://localhost:3000 in your web browser
