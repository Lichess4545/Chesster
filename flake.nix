{
  description = "Chesster, the Lichess4545 Slack bot, as a container image";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    dull-nix.url = "github:dull-ca/nix";
  };

  outputs = { self, nixpkgs, flake-utils, dull-nix }:
    flake-utils.lib.eachSystem [ "x86_64-linux" ] (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ dull-nix.overlays.default ];
        };
        nodejs = pkgs.nodejs_22;

        chesster = pkgs.stdenv.mkDerivation {
          pname = "chesster";
          version = (pkgs.lib.importJSON ./package.json).version;
          src = pkgs.lib.cleanSource ./.;
          yarnOfflineCache = pkgs.fetchYarnDeps {
            yarnLock = ./yarn.lock;
            hash = pkgs.lib.trim (builtins.readFile ./yarn-deps.hash);
          };
          nativeBuildInputs = [ nodejs pkgs.yarnConfigHook pkgs.yarnBuildHook ];
          installPhase = ''
            yarn install --production --offline --frozen-lockfile --ignore-scripts
            mkdir -p $out
            cp -r build config migrations node_modules package.json $out/
          '';
        };

        start = pkgs.writeShellScript "chesster-start" ''
          cd ${chesster}
          ${nodejs}/bin/node node_modules/sequelize-cli/lib/sequelize db:migrate --config config/db.js
          exec ${nodejs}/bin/node --max_old_space_size=768 build/chesster.js "$@"
        '';

        container = pkgs.dockerTools.buildLayeredImage {
          name = "chesster";
          tag = "latest";
          contents = [ pkgs.dockerTools.fakeNss pkgs.dockerTools.caCertificates ];
          extraCommands = "mkdir -m 1777 tmp";
          config = {
            Entrypoint = [ start ];
            User = "nobody";
            Env = [ "HOME=/tmp" "SSL_CERT_FILE=/etc/ssl/certs/ca-bundle.crt" ];
            Labels."org.opencontainers.image.source" = "https://github.com/Lichess4545/Chesster";
          };
        };
      in
      {
        checks = {
          inherit container;
          release-guards-hold = pkgs.releaseGuardsTest;
        };

        packages = {
          inherit chesster container;
          default = container;
          release = pkgs.mkReleaseCommand {
            repositoryUrl = "https://github.com/Lichess4545/Chesster";
            hooks = ./ci/release-hooks.sh;
            releaseWorkflow = "release.yml";
          };
          release-guards = pkgs.releaseGuards;
        };
      });
}
