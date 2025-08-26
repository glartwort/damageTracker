class DamageTrackerSettings extends FormApplication {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      title: "Damage Tracker Settings",
      id: "damage-tracker-settings",
      template: `modules/${MODULE_ID}/templates/settings.hbs`,
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

    if (!this._listenersActivated) {
      this._listenersActivated = true;
      this._pollInterval = setInterval(() => {
        if (this.rendered) this.render(false);
      },7000);
    };

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
      var exportData = "Actor Name, isNPC, Max Damage Roll, Max Damage, Total Damage\n";
      const dmgMap = game.settings.get(MODULE_ID,"damageMap");
      const sortedActors = Object.values(dmgMap).sort((a,b) => b.totDmg - a.totDmg);

      sortedActors.forEach(actor => {
        exportData += `${actor.name}, ${actor.isNPC}, ${actor.maxDmgRoll}, ${actor.maxDmg}, ${actor.totDmg}\n`;
      });

      new Dialog({
        title: "Export Damage Data (CSV)",
        content: `<textarea readonly style="width:100%; height:300px;">${exportData}</textarea>`,
        buttons: {
          close: {
            label: "Close"
          }
        }
      }).render(true);
    });
  }

  close() {
    clearInterval(this._pollInterval);
    super.close();
    if (isDebug) console.log(MODULE_ID, "| removed FormApplication timer, closed activelisteners");
  }

}
