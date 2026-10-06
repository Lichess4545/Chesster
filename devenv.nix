{ pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    yarn.enable = true;
  };

  services.postgres = {
    enable = true;
    listen_addresses = "127.0.0.1";
    initialDatabases = [{
      name = "chesster";
      user = "chesster";
      pass = "scrappypulpitgourdehinders";
    }];
  };

  packages = [
    pkgs.gh
    pkgs.git-cliff
    pkgs.jq
    pkgs.skopeo
  ];

  scripts.release.exec = ''cd "$DEVENV_ROOT" && exec nix run "$DEVENV_ROOT#release" -- "$@"'';
}
