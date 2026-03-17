import { spawn } from 'node:child_process';

/**
 * Validates a URL to ensure it uses an allowed protocol (http or https).
 */
export function validateUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol. Only http and https are allowed.');
    }
    return parsedUrl.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Opens a URL in the system's default browser.
 */
export function openUrl(url: string): void {
  const validatedUrl = validateUrl(url);

  if (process.platform === 'win32') {
    // On Windows, 'start' is a shell builtin. We use 'cmd /c' to invoke it.
    // To prevent ampersand (&) injection, we pass the URL as a single quoted argument.
    // Node's spawn with shell: false (default) will handle basic quoting,
    // but 'cmd /c start' has complex parsing rules.
    // Using '""' as the first argument to 'start' ensures the URL isn't interpreted as a window title.
    // We wrap the URL in double quotes to prevent shell characters like '&' from being interpreted.
    // Since validateUrl ensures no double quotes are in the string, this is safe.
    spawn('cmd', ['/c', 'start', '""', `"${validatedUrl}"`], {
      detached: true,
      stdio: 'ignore',
      shell: false,
    }).unref();
  } else {
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [validatedUrl], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}
