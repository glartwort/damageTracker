class DamageTrackerSettings extends FormApplication {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      title: "Damage Tracker Settings",
      id: "damage-tracker-settings",
      template: "modules/damagetracker/templates/settings.hbs",
      width: 600,
      height: "auto",
      resizable: false
    };
  }

  getData() {
    const dmgMap = game.settings.get(MODULE_ID,"damageMap");
    const sortedActors = Object.values(dmgMap).sort((a,b) => b.totDmg - a.totDmg);

    if (isDebug) {
      console.log(MODULE_ID, "|", "DamageTracker Actor list: ");
      console.log(MODULE_ID, "|", sortedActors);
    }

    return {
      enableNPCTracking: game.settings.get(MODULE_ID, "enableNPCTracking"),
      actors: sortedActors
    };  
  }

  async _updateObject(event, formData) {
  
    if (formData.clearTracking) {
      await game.settings.set(MODULE_ID, "damageMap", {});
      ui.notifications.info("Damage tracking data has been cleared.");
    }
  }

  //TODO: Should I add buttons for each "heading" to allow for Sorting by listening to each button and refreshing?

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".clear-tracking-button").click(async () => {
      const confirmed = await Dialog.confirm({
        title: "Confirm Clear",
        content: "<p>This will erase all tracked damage data. Are you sure?</p>"
      });
    
      if (confirmed) {
        await game.settings.set(MODULE_ID, "damageMap", {});
        ui.notifications.info("Damage tracking data has been cleared.");

        //refresh Settings page since data changed.
        this.render(true);
      }
    });

    html.find(".clear-NPCs-button").click(async () => {
      const confirmed = await Dialog.confirm({
        title: "Confirm Clear",
        content: "<p>This will erase non-Player Character tracked damage data. Are you sure?</p>"
      });
    
      if (confirmed) {
        const dmgMap = game.settings.get(MODULE_ID,"damageMap");
        
        //filter to only PCs and set damage map to new filtered set.
        const filteredActors = Object.values(dmgMap).filter((a) => !a.isNPC);

        const newDmgMap = {};

        filteredActors.forEach(actor => {
          newDmgMap[actor.key] = {
            name: actor.name,
            isNPC: actor.isNPC,
            maxDmgRoll: actor.maxDmgRoll,
            maxDmg: actor.maxDmg,
            totDmg: actor.totDmg
          }
        });
       
        await game.settings.set(MODULE_ID, "damageMap", newDmgMap);
        ui.notifications.info("Damage tracking data for NPCs has been cleared.");

        //refresh Settings page since data changed.
        this.render(true);
      }
    });

    html.find(".export-damage-map").click(() => {
      var exportData = "<!DOCTYPE html><html><body><table><th padding: 10px 20px;>Actor Name</th><th padding: 10px 20px;>Max Damage Roll</th><th padding: 10px 20px;>Max Damage</th><th padding: 10px 20px;>Total Damage</th>";
      const dmgMap = game.settings.get(MODULE_ID,"damageMap");
      const sortedActors = Object.values(dmgMap).sort((a,b) => b.totDmg - a.totDmg);

      sortedActors.forEach(actor => {
        exportData += `<tr><td>${actor.name}</td><td style="vertical-align: middle;">${actor.maxDmgRoll}</td><td style=style= vertical-align: middle;">${actor.maxDmg}</td><td style= vertical-align: middle;">${actor.totDmg}</td></tr>`;
      });

      exportData += `</table></body></html>`;

      new Dialog({
        title: "Export Damage Data",
        content: `<textarea readonly style="width:100%; height:300px;">${exportData}</textarea>`,
        buttons: {
          close: {
            label: "Close"
          }
        }
      }).render(true);
    });
  }
}
