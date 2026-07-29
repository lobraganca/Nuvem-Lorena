/**
 * Access to the administration panel.
 *
 * Read this before changing anything here.
 *
 * There is no such thing as client-side security. Any check written in this
 * file runs on a computer the visitor controls: they can read the code, edit
 * the stored data and call the functions by hand. A password kept in the
 * browser is a password written on the door.
 *
 * So the panel is not "protected" here — it is *absent*. The route only exists
 * when the build was made with VITE_ADMIN_ENABLED=true, which Vite bakes in as a
 * literal `false` otherwise, so the whole admin screen is removed
 * from the public bundle rather than merely hidden in it. Nothing to find in
 * the JavaScript, nothing to reach by typing an address.
 *
 * The real lock lives in front of the site (hosting-level authentication) and,
 * once accounts exist, in the server: every administrative action must verify
 * on the server that the caller is an administrator. See
 * docs/painel-administrativo.md.
 */
export const ADMIN_ENABLED = __ADMIN_ENABLED__;
