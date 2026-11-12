import { onRequest } from 'firebase-functions/v2/https'
import { handleOrganizationsRequest, type OrganizationExtension } from './api'
import { createSharingExtension } from './sharing/api'
import { createInteractionsExtension } from './interactions/api'
import { currentPermission } from './store'
import { activeMemberName, isActiveMember } from './membership/store'
import { membershipExtension } from './membership/api'

/** Feature wiring only: core permission stores never import membership. */
const sharingExtension = createSharingExtension(isActiveMember)
/** Viewing a pin means active membership plus a current share to that organization. */
const interactionsExtension = createInteractionsExtension({
  canView: async (uid, organizationId, pinId) =>
    (await isActiveMember(uid, organizationId)) &&
    (await currentPermission(pinId, organizationId)) !== null,
  authorName: activeMemberName,
})
export const organizationFeatures: OrganizationExtension = async (
  identity,
  body,
  res,
) =>
  (await membershipExtension(identity, body, res)) ||
  (await sharingExtension(identity, body, res)) ||
  (await interactionsExtension(identity, body, res))

export const organizationsApi = onRequest(
  { cors: false, memory: '512MiB', concurrency: 1, timeoutSeconds: 60 },
  (req, res) => handleOrganizationsRequest(req, res, organizationFeatures),
)
