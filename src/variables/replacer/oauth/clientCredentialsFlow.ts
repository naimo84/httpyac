import { OpenIdConfiguration, assertConfiguration } from './openIdConfiguration';
import { OpenIdInformation, requestOpenIdInformation } from './openIdInformation';
import { OpenIdFlow, OpenIdFlowContext } from './openIdFlow';
import { toQueryParams } from '../../../utils';

class ClientCredentialsFlow implements OpenIdFlow {
  supportsFlow(flow: string): boolean {
    return ['client_credentials', 'client'].indexOf(flow) >= 0;
  }

  getCacheKey(config: OpenIdConfiguration) {
    if (assertConfiguration(config, ['tokenEndpoint', 'clientId', 'clientSecret'])) {
      return `client_credentials_${config.clientId}_${config.tokenEndpoint}`;
    }
    return false;
  }


  async perform(config: OpenIdConfiguration, context: OpenIdFlowContext): Promise<OpenIdInformation | false> {
    const id = this.getCacheKey(config);
    if (id) {
      return requestOpenIdInformation({
        url: config.tokenEndpoint,
        method: 'POST',
        body: toQueryParams({
          grant_type: 'client_credentials',
          scope: config.scope,
        })
      }, {
        config,
        id,
        title: `clientCredentials: ${config.clientId}`,
        description: `${config.variablePrefix} - ${config.tokenEndpoint}`,
        details: {
          clientId: config.clientId,
          tokenEndpoint: config.tokenEndpoint,
          grantType: 'client_credentials',
        }
      }, context);
    }
    return false;
  }
}

export const clientCredentialsFlow = new ClientCredentialsFlow();
