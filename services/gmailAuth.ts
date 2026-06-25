import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import * as SecureStore from 'expo-secure-store'

WebBrowser.maybeCompleteAuthSession()

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
}

export function useGmailAuth() {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'meenakshi',
  })

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    },
    discovery
  )

  return { request, response, promptAsync }
}

export async function saveGmailToken(token: string) {
  await SecureStore.setItemAsync('gmail_access_token', token)
}

export async function getGmailToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('gmail_access_token')
}
