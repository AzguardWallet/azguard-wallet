// @ts-ignore
import inpageScript from "./inpage?script&module";
import { ProxyServer } from "./proxy/server";

const _ = new ProxyServer();

const script = document.createElement("script");
script.setAttribute("id", "azguard-inpage-script");
script.setAttribute("src", chrome.runtime.getURL(inpageScript));
script.setAttribute("type", "module");

const container = document.head || document.documentElement;
container.insertBefore(script, container.children[0]);
