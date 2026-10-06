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
}
