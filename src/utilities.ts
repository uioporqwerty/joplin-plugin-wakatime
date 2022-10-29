export function validAPIKey(key: string): boolean {
  const err =
    "Invalid api key... check https://wakatime.com/settings for your key";
  if (!key) {
    return false;
  }

  const re = new RegExp(
    "^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$",
    "i"
  );
  return re.test(key);
}

export function quote(str: string): string {
  if (str.includes(" ")) return `"${str.replace('"', '\\"')}"`;
  return str;
}
