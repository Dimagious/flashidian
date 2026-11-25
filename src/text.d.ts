/** Markdown files bundled as text (`build.loader` in opdk.config.mjs): the prompts in `prompts/`. */
declare module "*.md" {
    const text: string;
    export default text;
}
