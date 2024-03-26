import { createAppAuth } from '@octokit/auth-app';
import { AuthInterface } from '@octokit/auth-app/dist-types/types';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
dotenv.config();

export const getAppAuth = (credentials: {
  githubAppId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  installationId: string
}): AuthInterface => {
  let { githubAppId, privateKey, clientId, clientSecret, installationId } = credentials;
  if(!installationId) {
    installationId = process.env.INSTALLATION_ID!;
  }
  return createAppAuth({
    appId: githubAppId,
    privateKey,
    clientId,
    clientSecret,
    installationId
  });
}

export const getAuthorizationToken = async (appAuth: AuthInterface) => {
  await appAuth({type: 'installation'})
  const { token } =await appAuth({type: 'installation'})
  return token;
}

export const getAuthenticatedOctaKitClient = async(token: string) => {
  return new Octokit({auth: `Bearer ${token}`});
}
