import requests
import json
import os

def download_save(year, tract):
    fpath = 'lodes/%s/%s.json' % (year, tract)
    if os.path.exists(fpath):
        print 'found and opened %s' % fpath
        return json.load(open(fpath, 'rb'))
    base_url = 'https://s3-us-west-2.amazonaws.com/census-lodes'
    url = '%s/%s/%s.json' % (base_url, year, tract)
    r = requests.get(url)
    try:
        os.makedirs('lodes/%s' % year)
    except:
        pass
    with open(fpath, 'wb') as f:
        f.write(json.dumps(r.json()))
    print 'downloaded %s' % url
    return r.json()

def sum_up():
    return None

if __name__ == "__main__":
    tracts_geo = json.load(open('chicago_CBSA_tracts.json', 'rb'))
    features = tracts_geo['features']
    tracts = {f['properties']['tract_fips']: f['geometry'] for f in features}
    for year in range(2002, 2012):
        outp = {'type': 'FeatureCollection', 'features': []}
        for tract in tracts.keys():
            tract_info = {
                'type': 'Feature', 
                'geometry': tracts[tract],
                'properties': {}
            }
            tract_json = download_save(year, tract)
            t_from = sum([t.values()[0] for t in tract_json['traveling-from']])
            t_to = sum([t.values()[0] for t in tract_json['traveling-to']])
            tract_info['properties']['traveling-from'] = t_from
            tract_info['properties']['traveling-to'] = t_to
            tract_info['properties']['tract_fips'] = tract
            tract_info['properties']['year'] = year
            outp['features'].append(tract_info)
        with open('lodes/%s.json' % year, 'wb') as f:
            f.write(json.dumps(outp))
