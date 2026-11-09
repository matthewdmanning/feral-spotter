import { onRequest } from 'firebase-functions/v2/https'
import { handleOrganizationsRequest, type OrganizationExtension } from './api'
import { createSharingExtension } from './sharing/api'
import { isActiveMember } from './membership/service'
import { membershipExtension } from './membership/api'

/** Feature wiring only: core permission stores never import membership. */
const sharingExtension = createSharingExtension(isActiveMember)
export const organizationFeatures: OrganizationExtension = async (
  identity,
  body,
  res,
) =>
  (await membershipExtension(identity, body, res)) ||
  (await sharingExtension(identity, body, res))

export const organizationsApi = onRequest({ cors: false }, (req, res) =>
  handleOrganizationsRequest(req, res, organizationFeatures),
)
