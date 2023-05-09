let COMPLETIONS;

module.exports = {
  name: "autocomplete-powershell-winserver2022",
  getModule: () => {
    if (typeof COMPLETIONS === "object") {
      return COMPLETIONS.cmdlet.map(a => ({...a}));
    }
  },
  getParams: (cmdlet) => {
    if (typeof COMPLETIONS === "object") {
      if (COMPLETIONS.params[cmdlet]) {
        return COMPLETIONS.params[cmdlet].map(a => ({...a}));
      } else {
        return;
      }
    } else {
      return;
    }
  },
  load: () => {
    console.log("autocomplete-powershell-activeDirectory is up!");
    COMPLETIONS = require("../COMPLETIONS.json");
  }
}
