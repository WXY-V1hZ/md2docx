import { type PresetSaveOptions } from "../cli";
import { discoverPresets, type PresetDescriptor, savePreset, usePreset } from "../preset";

export async function listPresets(): Promise<void> {
  const presets = await discoverPresets();
  for (const preset of presets) {
    console.log(formatPresetListEntry(preset));
  }
}

export function formatPresetListEntry(preset: Pick<PresetDescriptor, "name" | "current">): string {
  return preset.current ? `${preset.name} \x1b[32m*\x1b[0m` : preset.name;
}

export async function selectPreset(name: string): Promise<void> {
  await usePreset(name);
  console.log(`当前预设：${name}`);
}

export async function saveUserPreset(options: PresetSaveOptions): Promise<void> {
  await savePreset(options);
  console.log(`已保存预设：${options.name}`);
}
