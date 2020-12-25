/* 
Based on ,
https://myanimelist.net/apiconfig/references/authorization#obtaining-oauth-20-access-tokens

Credits should go to this Python example as well,
https://gitlab.com/-/snippets/2039434
*/

const express = require("express");
const fetch = require("node-fetch");
const querystring = require("querystring");
const pkceChallenge = require("pkce-challenge");
const readline = require("readline");
const { writeFileSync } = require("fs");

const app = express();
const port = 3000;

// server for showing the authorization code
const server = app.listen(port, () => {
	init();
});

// route for displaying Authorization Code
app.get("/oauth", (req, res) => {
	res.send(
		`<h3>Your Authorization Code: </h3>
    <input type="text" value="${req.query.code}" style="font-size:20px; width: 80%; height: 40%"/>`
	);
});

// 0. Add your client info from https://myanimelist.net/apiconfig
const clientId = "put your client id here";
const clientSecret = "put your client secret here";

// 1. Generate a new Code Verifier / Code Challenge.
const getNewCodeVerifier = () => {
	const challenge = pkceChallenge(128);
	return challenge.code_verifier;
};

// 2. Request new application authorization code using a url
const requestAuthorizationCode = (codeChallenge) => {
	return new Promise((resolve, reject) => {
		const url = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&code_challenge=${codeChallenge}`;
		console.log(`Authorize your application by clicking here: ${url}\n\n`);

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.question("Copy & paste the Authorization Code:", (authorizationCode) => {
			rl.close();
			server.close();
			resolve(authorizationCode.trim());
		});
	});
};

/* 
3. Once you've authorized your application, you will be redirected to the webpage you've
specified in the API panel. The URL will contain a parameter named "code" (the Authorization
Code). You need to feed that code to the application. 

This example assumes your "App Redirect URL" is "http://localhost:3000/oauth" and display 
your authorization code there using Express.js. If you get 404 error that means your redirect 
url is different.
*/
const generateNewToken = async (authorizationCode, codeVerifier) => {
	const url = "https://myanimelist.net/v1/oauth2/token";

	const options = {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: querystring.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code: authorizationCode,
			code_verifier: codeVerifier,
			grant_type: "authorization_code",
		}),
	};

	const res = await fetch(url, options);
	const data = await res.json();

	if (res.status === 200) {
		console.log("Token generated successfully!");
		writeFileSync("token.json", JSON.stringify(data));
		console.log('Token saved in "token.json"');
		return data;
	} else {
		throw `Unable to generate the token!: ${JSON.stringify(data)}`;
	}
};

// 4. Test the API by requesting your profile information
const printUserInfo = (accessToken) => {
	fetch("https://api.myanimelist.net/v2/users/@me", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})
		.then((res) => {
			return res.json();
		})
		.then((data) => {
			console.log(`Greetings ${data.name}!.`);
		})
		.catch((e) => {
			console.log("Unable to request user info.", e);
		});
};

const init = async () => {
	const codeVerifier = getNewCodeVerifier();
	const codeChallenge = codeVerifier;

	authorizationCode = await requestAuthorizationCode(codeChallenge);

	generateNewToken(authorizationCode, codeVerifier)
		.then((token) => {
			printUserInfo(token.access_token);
		})
		.catch((e) => {
			console.log(e);
		});
};
