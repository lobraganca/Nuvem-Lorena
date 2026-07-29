/**
 * What the app is allowed to ask for while there is no server.
 *
 * A participant's CPF is personal data belonging to someone who may not even
 * use Avena. Today it would be written to the traveller's own phone, where it
 * is not encrypted at rest, has no retention limit, and — with no backend —
 * reaches no agency at all. That is exposure under the LGPD in exchange for
 * nothing.
 *
 * So the booking asks for names now, and the document is collected by the
 * agency at boarding. Flip this to true only once the backend exists, with
 * storage, a retention period and a way to erase on request.
 */
export const COLLECT_PARTICIPANT_DOCUMENTS = false;
