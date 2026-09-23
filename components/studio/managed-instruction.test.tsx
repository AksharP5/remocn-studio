import { expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManagedInstruction } from "./managed-instruction";

it("keeps separate element drafts and adds only the selected instruction to chat", () => {
  const onAdd = mock();
  const view = render(<ManagedInstruction objectId="title" onAdd={onAdd} />);
  const field = screen.getByRole("textbox");
  expect(screen.getByRole("button", { name: "Add to chat" })).toBeDisabled();
  fireEvent.change(field, { target: { value: "Make the title bounce" } });
  view.rerender(<ManagedInstruction objectId="background" onAdd={onAdd} />);
  expect(field).toHaveValue("");
  fireEvent.change(field, { target: { value: "Use a warmer color" } });
  view.rerender(<ManagedInstruction objectId="title" onAdd={onAdd} />);
  expect(field).toHaveValue("Make the title bounce");
  fireEvent.click(screen.getByRole("button", { name: "Add to chat" }));
  expect(onAdd).toHaveBeenCalledWith("Make the title bounce");
  expect(field).toHaveValue("");
  view.rerender(<ManagedInstruction objectId="background" onAdd={onAdd} />);
  expect(field).toHaveValue("Use a warmer color");
});

it("keeps Shift+Enter and IME input from submitting", () => {
  const onAdd = mock();
  render(<ManagedInstruction objectId="title" onAdd={onAdd} />);
  const field = screen.getByRole("textbox");
  fireEvent.change(field, { target: { value: "Slower entrance" } });
  fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(field, { isComposing: true, key: "Enter" });
  expect(onAdd).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: "Enter" });
  expect(onAdd).toHaveBeenCalledTimes(1);
});
