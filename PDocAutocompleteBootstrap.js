import PDokAutocomplete from "./PDocAutocomplete";
import { EventHandler } from "./EventHandler";

export default class PDocAutocompleteBootstrap extends EventHandler {
  constructor(selector, settings = {}) {
    super();
    this.selector = selector;
    this.settings = settings;
    this.instances = [];
    ["pointerup", "keyup"].forEach((event) =>
      document.addEventListener(event, (e) => this.onInput(e))
    );
  }

  onInput(e) {
    let target = e.target;

    // bail if the target already has a PDocAutocomplete instance
    if (target?.hasPDOC) return;

    console.log(target);

    // bail if the target doesn't match the selector
    if (!target?.matches(this.selector)) return;

    target.hasPDOC = true;

    // create a new instance of PDocAutocomplete
    let instance = new PDokAutocomplete(target, this.settings);

    target.dispatchEvent(new Event("input"));

    // handle events
    instance.on("*", (event, args) => {
      this.emit(event, args);
    });

    // add the instance to the instances array
    this.instances.push(instance);
  }
}
