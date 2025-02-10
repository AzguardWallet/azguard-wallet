import { ProxyClient } from "./proxy/client";
import { inject } from "./utils";

const azguardProp = "azguard";
const azguardObject = {
    version: "1.0.0",
    createClient: () => new ProxyClient(),
}

inject(azguardProp, azguardObject);
window.addEventListener("load", () => inject(azguardProp, azguardObject));
document.addEventListener("DOMContentLoaded", () => inject(azguardProp, azguardObject));
document.addEventListener("readystatechange", () => inject(azguardProp, azguardObject));