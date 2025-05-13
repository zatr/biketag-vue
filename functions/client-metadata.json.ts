import { builder, Handler } from '@netlify/functions'

const currentTagHandler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      client_id: 'https://biketag.org/api/client-metadata.json',
      application_type: 'web',
      client_name: 'BikeTag App',
      client_uri: 'https://biketag.org',
      dpop_bound_access_tokens: true,
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: ['https://biketag.org/callback'],
      response_types: ['code'],
      scope: 'atproto transition:generic',
      token_endpoint_auth_method: 'none',
    }),
  }
}

const handler = builder(currentTagHandler as Handler)

export { handler }
