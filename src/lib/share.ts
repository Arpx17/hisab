import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Capacitor.isNativePlatform() || (navigator as Navigator & { share?: unknown }).share) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    if (e instanceof Error && /cancel|abort/i.test(e.message)) return 'shared';
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

/** Save/share a text file: native share sheet on Android, download in a browser. */
export async function shareFile(filename: string, content: string, mime: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const written = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: filename, url: written.uri, dialogTitle: filename });
      return true;
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  } catch (e) {
    if (e instanceof Error && /cancel|abort/i.test(e.message)) return true;
    return false;
  }
}
