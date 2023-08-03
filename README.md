
# healthwise.ai

## Overview [![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)



healthwise.ai is a medical diagnoses app ***and not a replacement for a doctor***. It's a web application developed with Next.js, clerk and OpenAI that utilizes artificial intelligence and machine learning algorithms to assist in medical diagnoses. The app provides users with a user-friendly interface to input their symptoms and receive potential diagnoses and recommendations based on the input data and the AI's analysis.

## Features

- Symptom Input: Users can enter their symptoms into the app through a simple chatbox and intuitive user interface.
- AI Diagnosis: The app employs advanced AI algorithms to analyze the input symptoms and provide potential medical diagnoses.
- Recommendations: Along with diagnoses, the app offers recommendations for further actions, such as seeking immediate medical attention and/or suggesting self-care measures
- User Accounts: Users have the option to create accounts, allowing them to save their medical history and receive personalized recommendations.
- Privacy and Security: The app follows best practices for data privacy and security to protect user information and medical data.

## Technologies Used
- Clerk: For user authentication and protecting closed api routes.
- Next.js: A popular React framework for building server-side rendered and static web applications.
- OpenAI: JS library that enables the use of large language models directly within the browser by calling http requests to the open ai server.

## Getting Started
### Clone the repository

```git clone https://github.com/Yugaank-Kalia/healthwise.ai.git```

### Install dependencies:

```npm install```
### Environment Variables

To run this project, you will need to create a .env file and add the following environment variables to it

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = YOUR_API_KEY
CLERK_SECRET_KEY = YOUR_API_KEY

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

OPEN_AI_KEY = YOUR_API_KEY
```

### Create your Clerk API key:
go to [https://dashboard.clerk.com](https://dashboard.clerk.com/apps/new) to generate your api key and save it in your .env file

### Create your OpenAI API key:

go to [https://platform.openai.com](https://platform.openai.com/account/api-keys) to generate your api key and save it in your .env file

### Start the development server

```
npm run dev
Open your browser and navigate to http://localhost:3000 to access the app.
```
### License

This project is licensed under the MIT License.


## Features to be added

- [ ]  Landing Page for the web application
- [ ]  Lung cancer detection using MRI scans
- [ ]  Creating a custom model using falcon LLM


## Screenshots

![App Screenshot](https://awesomescreenshot.s3.amazonaws.com/image/4715883/41977933-99304a50e388f6786ae07022e6a68bbc.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAJSCJQ2NM3XLFPVKA%2F20230803%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20230803T152116Z&X-Amz-Expires=28800&X-Amz-SignedHeaders=host&X-Amz-Signature=c74ce89e424d832374b073133019c8f589308d6e2623ebbcec155c28e71abc88)

## Contact

If you have any questions, feedback or contributions, feel free to contact me at yugaank@outlook.com
