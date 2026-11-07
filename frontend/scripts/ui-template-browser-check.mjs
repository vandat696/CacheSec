import assert from "node:assert/strict";
/* global NoiUI:readonly, templateCatalog:readonly */

// Exercise the standalone browser contract, not a mock DOM or generated source shape.
export async function checkUiTemplates({ evaluate }) {
  const result = await evaluate(
    `(${async function () {
      const check = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const host = document.createElement("div");
      document.body.append(host);
      const instances = [];
      const mount = (instance) => {
        instances.push(instance);
        host.append(instance.element);
        return instance;
      };
      try {
        for (const [name, , , , options] of templateCatalog) {
          const instance = mount(NoiUI.create(name, options));
          check(instance.element instanceof HTMLElement, name + ": mount");
          check(typeof instance.destroy === "function", name + ": lifecycle");
        }
        let clicks = 0;
        const button = mount(
          NoiUI.Button({ label: "Test", onClick: () => clicks++ }),
        );
        button.element.click();
        button.setLoading(true);
        check(
          clicks === 1 && button.element.disabled,
          "Button callback/loading",
        );
        button.setLoading(false);
        check(!button.element.disabled, "Button loading reset");
        const number = mount(
          NoiUI.NumberInput({
            label: "Number",
            min: 2,
            max: 10,
            step: 2,
            value: 3,
          }),
        );
        check(!number.validate(), "NumberInput rejects invalid step");
        number.setValue(4);
        check(
          number.validate() && number.getValue() === 4,
          "NumberInput valid value",
        );
        const slider = mount(
          NoiUI.Slider({
            label: "Slider",
            min: 0,
            max: 2,
            step: 0.1,
            value: 0.7,
          }),
        );
        slider.setValue(1.2);
        check(
          slider.getValue() === 1.2 && slider.validate(),
          "Slider synchronization",
        );
        let changes = 0;
        const checkbox = mount(
          NoiUI.Checkbox({ label: "Check", onChange: () => changes++ }),
        );
        const input = checkbox.input;
        input.dispatchEvent(new Event("change"));
        checkbox.destroy();
        input.dispatchEvent(new Event("change"));
        check(
          changes === 1 && !checkbox.element.isConnected,
          "Destroy aborts listeners",
        );
        const tabs = mount(
          NoiUI.Tabs({
            items: [
              { id: "a", label: "A", content: "First" },
              { id: "b", label: "B", content: "Second" },
            ],
          }),
        );
        tabs.select(1);
        check(
          tabs.element
            .querySelectorAll('[role="tab"]')[1]
            .getAttribute("aria-selected") === "true",
          "Tabs selection",
        );
        let selection;
        const dropdown = mount(
          NoiUI.Dropdown({
            items: [{ label: "Item", value: "chosen" }],
            onSelect: (value) => (selection = value),
          }),
        );
        dropdown.open();
        dropdown.element.querySelector('[role="menuitem"]').click();
        check(selection === "chosen", "Dropdown selection");
        let confirmed = 0;
        const dialog = mount(
          NoiUI.Dialog({ title: "Dialog", onConfirm: () => confirmed++ }),
        );
        dialog.open();
        check(dialog.element.open, "Dialog open");
        dialog.element.querySelector('[data-variant="primary"]').click();
        check(!dialog.element.open && confirmed === 1, "Dialog confirm/close");
        const table = mount(
          NoiUI.DataTable({
            columns: [{ key: "value", label: "Value" }],
            rows: [{ value: 1 }],
          }),
        );
        table.setData([{ value: "<img src=x>" }]);
        check(
          !table.element.querySelector("img") &&
            table.element.textContent.includes("<img src=x>"),
          "DataTable text insertion",
        );
        for (const name of ["LineChart", "BarChart", "DonutChart"]) {
          const chart = mount(
            NoiUI[name]({ title: name, data: [{ label: "A", value: 2 }] }),
          );
          check(!!chart.element.querySelector("svg"), name + ": render");
          chart.setData([]);
          check(
            !!chart.element.querySelector(".nui-empty"),
            name + ": empty data",
          );
        }
        const flow = mount(
          NoiUI.FlowDiagram({
            nodes: [
              { id: "one", label: "One" },
              { id: "two", label: "Two" },
            ],
          }),
        );
        flow.select("two");
        check(
          flow.element
            .querySelector('[data-node-id="two"]')
            .getAttribute("aria-pressed") === "true",
          "FlowDiagram selection",
        );
        const toast = mount(NoiUI.Toast({ message: "Message" }));
        toast.show("Updated");
        check(toast.element.textContent.includes("Updated"), "Toast update");
        return { components: templateCatalog.length, interactions: "pass" };
      } finally {
        instances.forEach((instance) => instance.destroy());
        host.remove();
      }
    }.toString()})()`,
  );
  assert.deepEqual(result, { components: 21, interactions: "pass" });
}
