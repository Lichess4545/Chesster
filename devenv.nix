{ pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    package = import ./nix/nodejs.nix pkgs;
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
    pkgs.prefetch-yarn-deps
    pkgs.skopeo
  ];

  git-hooks.hooks.yarn-deps-hash = {
    enable = true;
    entry = "ci/yarn-deps-hash.sh";
    files = "^yarn\\.lock$";
    pass_filenames = false;
  };

  git-hooks.hooks.nixpkgs-pin = {
    enable = true;
    entry = "ci/nixpkgs-pin.sh";
    files = "^(flake|devenv)\\.lock$";
    pass_filenames = false;
  };

  scripts.release.exec = ''cd "$DEVENV_ROOT" && exec nix run "$DEVENV_ROOT#release" -- "$@"'';
}
