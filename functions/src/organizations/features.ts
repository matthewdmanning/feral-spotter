import { onRequest } from 'firebase-functions/v2/https'
import { handleOrganizationsRequest, type OrganizationExtension } from './api'
import { membershipExtension } from './membership/api'

/** Feature wiring only: core permission stores never import membership. */
export const organizationFeatures: OrganizationExtension = membershipExtension

export const organizationsApi = onRequest({ cors: false }, (req, res) =>
  handleOrganizationsRequest(req, res, organizationFeatures),
)
