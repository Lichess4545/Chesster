{ pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    yarn.enable = true;
  };

  services.postgres = {
    enable = true;
    initialDatabases = [{ name = "chesster"; }];
  };
}
